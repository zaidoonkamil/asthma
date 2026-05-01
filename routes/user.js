const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Op } = require("sequelize");
const uploadImage = require("../middlewares/uploads");
const { User, UserDevice } = require("../models");

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
  const { name, governorate, age, gender, height, password } = req.body;
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
