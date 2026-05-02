const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Op } = require("sequelize");
const uploadImage = require("../middlewares/uploads");
const { User, UserDevice, UserMedication, Medication } = require("../models");

const router = express.Router();
const upload = multer();
const saltRounds = 10;

const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).trim().replace(/\s+/g, "");
};


const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "700d" }
  );

const tokenFromHeader = (authorization) => {
  const value = String(authorization || "").trim();
  if (value.toLowerCase().startsWith("bearer ")) {
    return value.slice(7).trim();
  }
  return value;
};

const requireAuth = (req, res, next) => {
  const authToken = tokenFromHeader(req.headers.authorization);

  if (!authToken) {
    return res.status(401).json({ error: "Token is missing" });
  }

  try {
    req.authUser = jwt.verify(authToken, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = async (req, res, next) => {
  const user = await User.findByPk(req.authUser.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  req.currentUser = user;
  return next();
};

const normalizeKeySteps = (keySteps) => {
  if (Array.isArray(keySteps)) {
    return keySteps.map((step) => String(step).trim()).filter(Boolean);
  }

  if (typeof keySteps === "string") {
    const trimmed = keySteps.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((step) => String(step).trim()).filter(Boolean);
      }
    } catch (_) {
      return trimmed
        .split(/\r?\n/)
        .map((step) => step.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const medicationPayload = (body, file) => {
  const keySteps = normalizeKeySteps(body.key_steps);
  const payload = {
    name: String(body.name || "").trim(),
    short_description: String(body.short_description || "").trim(),
    long_description: String(body.long_description || "").trim(),
    schedule_description: String(body.schedule_description || "").trim(),
    key_steps: keySteps,
    video_url: String(body.video_url || "").trim() || null,
    icon: String(body.icon || "").trim() || null,
    color: String(body.color || "").trim() || null,
    is_active:
      body.is_active === undefined ? true : String(body.is_active) !== "false",
  };

  if (file) {
    payload.image = file.filename;
  }

  return payload;
};

const serializeMedication = (medication) => ({
  id: medication.id,
  name: medication.name,
  short_description: medication.short_description,
  long_description: medication.long_description,
  schedule_description: medication.schedule_description,
  key_steps: medication.key_steps || [],
  video_url: medication.video_url,
  image: medication.image,
  image_url: medication.image ? `/uploads/${medication.image}` : null,
  icon: medication.icon,
  color: medication.color,
  is_active: medication.is_active,
});

const saveUserDevice = async (userId, playerId) => {
  const cleanPlayerId = String(playerId || "").trim();
  if (!cleanPlayerId) return null;

  const existingDevice = await UserDevice.findOne({
    where: { player_id: cleanPlayerId },
  });

  if (existingDevice) {
    if (existingDevice.user_id !== userId) {
      existingDevice.user_id = userId;
      await existingDevice.save();
    }
    return existingDevice;
  }

  return UserDevice.create({
    user_id: userId,
    player_id: cleanPlayerId,
  });
};

router.post("/users", uploadImage.array("images", 5), async (req, res) => {
  const { name, location, password, role = "user" } = req.body;
  let { phone } = req.body;

  try {
    phone = normalizePhone(phone);

    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ error: "Allowed role values are admin or user" });
    }

    if (!name || !phone || !location || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingPhone = await User.findOne({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ error: "Phone number is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const images =
      req.files && Array.isArray(req.files)
        ? req.files.map((file) => file.filename)
        : [];

    const user = await User.create({
      name,
      phone,
      location,
      password: hashedPassword,
      role,
      isVerified: role === "admin",
      image: images.length > 0 ? images[0] : null,
    });

    return res.status(201).json({
      id: user.id,
      image: user.image,
      name: user.name,
      phone: user.phone,
      location: user.location,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/onboarding/register", upload.none(), async (req, res) => {
  const { name, governorate, age, gender, height, password, player_id } = req.body;
  let { phone } = req.body;

  try {
    const cleanName = String(name || "").trim();
    phone = normalizePhone(phone);
    const cleanGovernorate = String(governorate || "").trim();
    const cleanGender = String(gender || "").trim();
    const parsedAge = Number.parseInt(age, 10);
    const parsedHeight = Number.parseInt(height, 10);
    const cleanPassword = String(password || "");

    if (
      !cleanName ||
      !phone ||
      !cleanGovernorate ||
      !cleanGender ||
      !cleanPassword ||
      Number.isNaN(parsedAge) ||
      Number.isNaN(parsedHeight)
    ) {
      return res.status(400).json({ error: "All onboarding fields are required" });
    }

    const existingPhone = await User.findOne({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ error: "Phone number is already in use" });
    }

    if (!["Male", "Female"].includes(cleanGender)) {
      return res.status(400).json({ error: "Gender must be Male or Female" });
    }

    if (parsedAge < 1 || parsedAge > 120) {
      return res.status(400).json({ error: "Age must be between 1 and 120" });
    }

    if (parsedHeight < 40 || parsedHeight > 250) {
      return res.status(400).json({ error: "Height must be between 40 and 250" });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, saltRounds);

    const user = await User.create({
      name: cleanName,
      phone,
      location: cleanGovernorate,
      age: parsedAge,
      gender: cleanGender,
      height: parsedHeight,
      password: hashedPassword,
      role: "user",
      isVerified: true,
    });

    const token = generateToken(user);
    await saveUserDevice(user.id, player_id);

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        governorate: user.location,
        age: user.age,
        gender: user.gender,
        height: user.height,
        role: user.role,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (err) {
    console.error("Onboarding register error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/users/device", upload.none(), requireAuth, async (req, res) => {
  try {
    const playerId = req.body.player_id;
    if (!playerId) {
      return res.status(400).json({ error: "player_id is required" });
    }

    const user = await User.findByPk(req.authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const device = await saveUserDevice(user.id, playerId);
    return res.status(201).json({
      message: "Device saved successfully",
      device: {
        id: device.id,
        player_id: device.player_id,
        user_id: device.user_id,
      },
    });
  } catch (err) {
    console.error("Save user device error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/medications", requireAuth, async (req, res) => {
  try {
    const medications = await Medication.findAll({
      where: { is_active: true },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      medications: medications.map(serializeMedication),
    });
  } catch (err) {
    console.error("Get medications error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/admin/medications", requireAuth, requireAdmin, async (req, res) => {
  try {
    const medications = await Medication.findAll({
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      medications: medications.map(serializeMedication),
    });
  } catch (err) {
    console.error("Admin get medications error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/admin/medications",
  uploadImage.single("image"),
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const payload = medicationPayload(req.body, req.file);

      if (
        !payload.name ||
        !payload.short_description ||
        !payload.long_description ||
        !payload.schedule_description ||
        payload.key_steps.length === 0
      ) {
        return res.status(400).json({
          error:
            "name, short_description, long_description, schedule_description and key_steps are required",
        });
      }

      const medication = await Medication.create(payload);
      return res.status(201).json({
        message: "Medication created successfully",
        medication: serializeMedication(medication),
      });
    } catch (err) {
      console.error("Create medication error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.put(
  "/admin/medications/:id",
  uploadImage.single("image"),
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const medication = await Medication.findByPk(req.params.id);
      if (!medication) {
        return res.status(404).json({ error: "Medication not found" });
      }

      const payload = medicationPayload(req.body, req.file);
      if (
        !payload.name ||
        !payload.short_description ||
        !payload.long_description ||
        !payload.schedule_description ||
        payload.key_steps.length === 0
      ) {
        return res.status(400).json({
          error:
            "name, short_description, long_description, schedule_description and key_steps are required",
        });
      }

      await medication.update(payload);
      return res.status(200).json({
        message: "Medication updated successfully",
        medication: serializeMedication(medication),
      });
    } catch (err) {
      console.error("Update medication error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.delete(
  "/admin/medications/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const medication = await Medication.findByPk(req.params.id);
      if (!medication) {
        return res.status(404).json({ error: "Medication not found" });
      }

      await medication.update({ is_active: false });
      return res.status(200).json({ message: "Medication disabled" });
    } catch (err) {
      console.error("Disable medication error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.get("/users/medications", requireAuth, async (req, res) => {
  try {
    const medications = await UserMedication.findAll({
      where: { user_id: req.authUser.id },
      include: [{ model: Medication, as: "medication", where: { is_active: true } }],
      order: [["createdAt", "ASC"]],
    });

    return res.status(200).json({
      medication_ids: medications.map((item) => String(item.medication_id)),
      medications: medications.map((item) => serializeMedication(item.medication)),
    });
  } catch (err) {
    console.error("Get user medications error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/users/medications", requireAuth, async (req, res) => {
  try {
    const rawIds = req.body.medication_ids;
    const medicationIds = Array.isArray(rawIds)
      ? rawIds
      : typeof rawIds === "string"
      ? JSON.parse(rawIds)
      : [];

    if (!Array.isArray(medicationIds)) {
      return res.status(400).json({ error: "medication_ids must be an array" });
    }

    const cleanIds = [
      ...new Set(
        medicationIds
          .map((id) => Number.parseInt(id, 10))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ];

    const existingMedications = await Medication.findAll({
      where: { id: cleanIds, is_active: true },
      attributes: ["id"],
    });
    const existingIds = existingMedications.map((item) => item.id);

    await UserMedication.destroy({ where: { user_id: req.authUser.id } });

    if (existingIds.length > 0) {
      await UserMedication.bulkCreate(
        existingIds.map((id) => ({
          user_id: req.authUser.id,
          medication_id: id,
        }))
      );
    }

    return res.status(200).json({ medication_ids: existingIds.map(String) });
  } catch (err) {
    console.error("Save user medications error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/login", upload.none(), async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: "Your account is not verified yet",
        code: "ACCOUNT_NOT_VERIFIED",
        phone: user.phone,
        isVerified: false,
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        isVerified: user.isVerified,
        role: user.role,
        location: user.location,
        age: user.age,
        gender: user.gender,
        height: user.height,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id, {
      include: { model: UserDevice, as: "devices" },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.destroy();

    return res.status(200).json({ message: "User and devices deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ error: "Delete failed" });
  }
});

router.get("/verify-token", (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.json({ valid: false, message: "Token is missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.json({ valid: false, message: "Invalid token" });
    }
    return res.json({ valid: true, data: decoded });
  });
});

router.get("/usersOnly", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: { role: "user" },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      users,
      pagination: {
        totalUsers: count,
        currentPage: page,
        totalPages,
        limit,
      },
    });
  } catch (err) {
    console.error("Error fetching users with pagination:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/profile", async (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Token is missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

module.exports = router;
