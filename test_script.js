/**
 * 这是一个测试脚本，用于验证 Early Quokka 的 PR 监控和审查功能。
 */
function processData(items) {
  // 故意留下的低效循环示例，供后续 Code Review 识别
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      console.log("Processing pair:", items[i], items[j]);
    }
  }
}

const data = [1, 2, 3];
processData(data);
