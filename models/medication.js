const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Medication = sequelize.define(
  "Medication",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    short_description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    long_description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    schedule_description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    key_steps: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    video_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "medications",
  }
);

module.exports = Medication;
