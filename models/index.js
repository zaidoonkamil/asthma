const User = require("./user");
const UserDevice = require("./user_device");
const NotificationLog = require("./notification_log");
const UserMedication = require("./user_medication");
const Medication = require("./medication");
const Doctor = require("./doctor");


User.hasMany(UserDevice, { foreignKey: 'user_id', as: 'devices', onDelete: 'CASCADE' });
UserDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
User.hasMany(UserMedication, { foreignKey: 'user_id', as: 'medications', onDelete: 'CASCADE' });
UserMedication.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
Medication.hasMany(UserMedication, { foreignKey: 'medication_id', as: 'userSelections', onDelete: 'CASCADE' });
UserMedication.belongsTo(Medication, { foreignKey: 'medication_id', as: 'medication', onDelete: 'CASCADE' });
Doctor.hasMany(User, { foreignKey: 'doctor_id', as: 'patients', onDelete: 'SET NULL' });
User.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor', onDelete: 'SET NULL' });


module.exports = {
  User,
  UserDevice,
  NotificationLog,
  UserMedication,
  Medication,
  Doctor,
};
