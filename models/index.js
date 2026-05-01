const User = require("./user");
const UserDevice = require("./user_device");
const NotificationLog = require("./notification_log");


User.hasMany(UserDevice, { foreignKey: 'user_id', as: 'devices', onDelete: 'CASCADE' });
UserDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });


module.exports = {
  User,
  UserDevice,
  NotificationLog,
};
