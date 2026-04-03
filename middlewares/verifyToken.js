const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  try {
    let token = req.header('Authorization');

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token, authorization denied' });
    }

    // Accept both "Bearer <token>" and raw "<token>"
    if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7).trim();
    }

    // debug: show token present length (remove in prod)
    console.log('verifyToken: token length:', token ? token.length : 0);

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('verifyToken error:', error.message || error);
    return res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

module.exports = verifyToken;
