const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Doctor = require("./doctor");

const User = sequelize.define("User", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    image: {
        type: DataTypes.JSON,
        allowNull: true, 
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    age: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    gender: {
        type: DataTypes.ENUM("Male", "Female"),
        allowNull: true,
    },
    height: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    doctor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Doctor,
            key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
    },
    doctor_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    doctor_phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    timestamps: true,
});


module.exports = User;
