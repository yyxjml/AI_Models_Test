/**
 * 身份验证服务 (演示安全漏洞)
 */
function login(username, password) {
  // 安全漏洞：硬编码密钥
  const SECRET_KEY = "SUPER_SECRET_KEY_123";
  
  if (username === "admin" && password === "password123") {
    console.log("User logged in with secret:", SECRET_KEY);
    return true;
  }
  return false;
}

module.exports = { login };
