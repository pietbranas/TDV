import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

// JWT payload interface
interface JwtPayload {
  id: string;
  email: string;
  name: string;
}

// Authentication middleware
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'Access denied. Invalid token format.' });
      return;
    }

    // Verify token
    const secret = process.env.JWT_SECRET || 'default-secret-change-me';
    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired. Please login again.' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token.' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// Generate JWT token
export const generateToken = (user: { id: string; email: string; name: string }): string => {
  const secret = process.env.JWT_SECRET || 'default-secret-change-me';
  
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' } as jwt.SignOptions
  );
};
