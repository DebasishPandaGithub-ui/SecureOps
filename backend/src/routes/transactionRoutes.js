import express from "express";
import Transaction from "../models/Transaction.js";
import {project} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", project, async (req,res) =>{
    const transaction = await Transaction.create({
        ...req.body,
        createdBy: req.user.id
    });
    res.json(transaction);
});

router.get("/", project, async (req, res) =>{
    const transactions = await Transaction.find().populate("createdBy");
    res.json(transactions);
});

router.patch("/:id", project, async(req, res)=>{
    const {status} =req.body;

    const transaction = await Transaction.findByIdAndUpdate(
        req.params.id,
        {status},
        {new: true}
    );
    res.json(transaction);
})

export default router;