const mongoose = require("mongoose");
let validator = require('validator');

const gameSettingsModel = new mongoose.Schema(
    {

        email: {
            type: String,
            required: [true, "Please provide an Email!"],
            unique: false,
            lowercase: true,
            validate: (value) => {
                return validator.isEmail(value);
            }
        },

        name: {
            type: String,
            required: [true, "Please provide a name!"],
            unique: false,
        },

        questions: [{
            question: {
                type: String,
                required: [true, "Please provide a question!"],
                unique: false,
            },

            answers: [{

                answerText: {
                    type: String,
                    required: [true, "Please provide an answer!"],
                    unique: false,
                },

                state: {
                    type: Boolean,
                    required: [true, "Please provide an answer type!"],
                    unique: false,
                }

            }],

            points: {
                type: Number,
                required: [true, "Please provide a point count!"],
                unique: false,
            },

        }]

    },
    {
        timestamps: true
    }
)

module.exports = mongoose.model("GameSettings", gameSettingsModel);