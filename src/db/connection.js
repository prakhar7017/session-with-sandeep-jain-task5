const mongoose=require("mongoose");


mongoose.connect(`mongodb+srv://${process.env.MONGO_NAME}:${process.env.MONGO_PASSWORD}@cluster0.isbmcbp.mongodb.net/?retryWrites=true&w=majority`,{
    useNewUrlParser:true,
    useUnifiedTopology:true
}).then(()=>{
    console.log("connection is successful");
}).catch((e)=>{
    console.log(e);
    console.log("no connection");
})