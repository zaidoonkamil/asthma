const User = require("./user");
const UserDevice = require("./user_device");
const NotificationLog = require("./notification_log");
const UserMedication = require("./user_medication");
const Medication = require("./medication");


User.hasMany(UserDevice, { foreignKey: 'user_id', as: 'devices', onDelete: 'CASCADE' });
UserDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
User.hasMany(UserMedication, { foreignKey: 'user_id', as: 'medications', onDelete: 'CASCADE' });
UserMedication.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
Medication.hasMany(UserMedication, { foreignKey: 'medication_id', as: 'userSelections', onDelete: 'CASCADE' });
UserMedication.belongsTo(Medication, { foreignKey: 'medication_id', as: 'medication', onDelete: 'CASCADE' });


module.exports = {
  User,
  UserDevice,
  NotificationLog,
  UserMedication,
  Medication,
};
