const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserMedication = sequelize.define(
  "UserMedication",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    medication_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "user_medications",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "medication_id"],
      },
    ],
  }
);

module.exports = UserMedication;
