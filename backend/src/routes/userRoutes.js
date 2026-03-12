import express from "express";
import User from "../models/User.js";
import {project, authorize} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", project, authorize("admin"), async (req,res) => {
    const users = await User.find();
    res.json(users);
})

export default router;