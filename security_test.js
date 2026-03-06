const auth = require('./auth_service');
const assert = require('assert');

console.log("🛡️ 运行安全逻辑测试...");

try {
  // 故意失败：错误的逻辑判断
  assert.strictEqual(auth.login("user", "wrong_pass"), true, "安全校验异常：未授权用户通过了验证");
} catch (err) {
  console.error("❌ 安全测试失败！系统拒绝了非法访问。");
  process.exit(1);
}
