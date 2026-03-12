import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    title:String,
    amount:Number,
    status:{type: String, enum:["pending","approved","rejected"], default:"pending"},
    createdBy:{type:mongoose.Schema.Types.ObjectId, ref:"User"}
}, {timestamps:true});

export default mongoose.model("Transaction", transactionSchema);