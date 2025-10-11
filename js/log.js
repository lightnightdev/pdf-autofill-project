
// --------------------
// Utility: log messages
// --------------------
function log(msg) {
  const logbox = document.getElementById("logbox");
  logbox.textContent += " > " + msg + "\n";
  logbox.scrollTop = logbox.scrollHeight;
}