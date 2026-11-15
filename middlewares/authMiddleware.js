const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Token not provided.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
        return res.status(401).json({ success: false, error: 'Token error format.' });
    }

    const [scheme, token] = parts;
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ success: false, error: 'Token malformatted.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || !Number.isSafeInteger(decoded?.id) || decoded.id < 1) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
        }

        req.userId = decoded.id;
        
        return next();
    });
};

module.exports = authMiddleware;
