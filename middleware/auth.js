const jwt = require('jsonwebtoken');

const verification = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
        req.isAuth = false;
        return next()
    }
    const token = authHeader.split(' ')[1];
    let decodedToken = null;
    try {
        decodedToken = jwt.verify(token, 'the-secret-parameter')
    } catch (error) {
        req.isAuth = false;
        return next();
    }
    if (!decodedToken) {
        req.isAuth = false;
        return next();
    }
    req.userId = decodedToken.userId;
    req.isAuth = true;
    next();
}

module.exports = {
    verification
}