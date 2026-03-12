import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" } // Corrected "1d"
    );
};

export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed, role });

        res.status(201).json({
            token: generateToken(user),
            user: { id: user._id, role: user.role, name: user.name }
        });
    } catch (error) {
        res.status(400).json({ message: "Registration failed", error: error.message });
    }
};

// ADD THIS LOGIN FUNCTION
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                token: generateToken(user),
                user: { id: user._id, role: user.role, name: user.name }
            });
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};