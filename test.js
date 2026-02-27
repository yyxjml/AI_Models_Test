const assert = require('assert');
console.log("🚀 正在运行自动化测试...");
try {
  assert.strictEqual(1, 2, "核心逻辑校验失败：预期 1 等于 2");
} catch (err) {
  console.error("❌ 测试未通过！");
  console.error(err.message);
  process.exit(1);
}
