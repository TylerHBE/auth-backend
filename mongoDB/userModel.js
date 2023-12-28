const mongoose = require("mongoose");
let validator = require('validator');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Please provide an Email!"],
        unique: [true, "Email Exist"],
        lowercase: true,
        validate: (value) => {
            return validator.isEmail(value);
        }
    },
  
    password: {
        type: String,
        required: [true, "Please provide a password!"],
        unique: false,
    },    

    username: {
        type: String,
        required: [true, "Please provide a username!"],
        unique: false,
    },   
    
    avatar: {
        type: String,
        required: false,
        unique: false,
    },
    
    birthdate: {
        type: String,
        required: false,
        unique: false,
    },

    favColor: {
        type: String,
        required: false,
        unique: false,
    }

})
  
module.exports = mongoose.model.Users || mongoose.model("Users", UserSchema);