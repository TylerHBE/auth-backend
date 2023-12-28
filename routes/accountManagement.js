const express = require('express')
const router = express.Router();

// user data model for mongoDB
const User = require("../mongoDB/userModel");
// encryption for password + other data
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("../auth");

// register endpoint
router.post("/sign-Up", (request, response) => {
    // hash the password
    bcrypt
        .hash(request.body.password, 10)
        .then((hashedPassword) => {
            // create a new user instance and collect the data
            const user = new User({
                email: request.body.email,
                password: hashedPassword,
                username: request.body.username,
                avatar: "baseUser",
                favColor: "black"
            });

            // save the new user
            user
                .save()
                // return success if the new user is added to the database successfully
                .then(() => {

                    const token = jwt.sign(
                        {
                            userId: user._id,
                            userEmail: user.email,
                        },
                        "RANDOM-TOKEN", // protect by .env in prod---> also in auth.js + others, !!!!!!!!!!!!
                        { expiresIn: "24h" }
                    );

                    response.status(201).send({
                        message: "User Created Successfully",
                        email: user.email,
                        username: user.username,
                        avatar: user.avatar,
                        favColor: user.favColor,
                        token,
                    });
                })
                // catch error if the new user wasn't added successfully to the database
                .catch((error) => {
                    response.status(500).send({
                        message: "Error creating user",
                        error,
                    });
                });
        })
        // catch error if the password hash isn't successful
        .catch((e) => {
            response.status(500).send({
                message: "Password was not hashed successfully",
                e,
            });
        });
});

// login endpoint
router.post("/log-in", (request, response) => {
    // check if email exists
    User.findOne({ email: request.body.email })

        // if email exists
        .then((user) => {
            // compare the password entered and the hashed password found
            bcrypt
                .compare(request.body.password, user.password)

                // if the passwords match
                .then((passwordCheck) => {

                    // check if password matches
                    if (!passwordCheck) {
                        return response.status(400).send({
                            message: "Passwords does not match",
                            error,
                        });
                    }

                    //   create JWT token
                    const token = jwt.sign(
                        {
                            userId: user._id,
                            userEmail: user.email,
                        },
                        "RANDOM-TOKEN", // protect by .env in prod---> also in auth.js + others, !!!!!!!!!!!!
                        { expiresIn: "24h" }
                    );

                    //   return success response
                    response.status(200).send({
                        message: "Login Successful",
                        email: user.email,
                        username: user.username,
                        avatar: user.avatar,
                        favColor: user.favColor,
                        token,
                    });
                })
                // catch error if password does not match
                .catch((error) => {
                    response.status(400).send({
                        message: "Passwords does not match",
                        error,
                    });
                });
        })
        // catch error if email does not exist
        .catch((e) => {
            response.status(404).send({
                message: "Email not found",
                e,
            });
        });
});

// avatar update endpoint
router.post("/update-avatar", auth, (request, response) => {

    // Validate avatar
    const avatarList = ["baseUser", "blackDog", "brownBear", "cat", "chicken", "giraffe", "gorilla", "lion", "meerkat", "orangeBear", "orangeDog", "panda", "rabbit", "seaLion", "shark", "wolf"];

    if (!avatarList.includes(request.body.avatar)) {
        response.status(500).send({
            message: "Avatar does not exist!",
            error: "Nonexistant avatar symbol passed"
        });
    }
    else {
        // find the user + update
        User.findOneAndUpdate(
            {
                email: request.user.userEmail // search query
            },
            {
                avatar: request.body.avatar // field:values to update
            },
            {
                new: true, // return updated doc
                runValidators: true // validate before update
            }
        )
            // return success if the avatar is added to the database successfully
            .then((result) => {
                response.status(201).send({
                    message: "Avatar created successfully",
                    avatar: request.body.avatar,
                    result,
                });
            })
            // catch error if the avatar wasn't added successfully to the database
            .catch((error) => {
                response.status(500).send({
                    message: "Error updating avatar",
                    error,
                });
            });
    }

});

// favColor update endpoint
router.post("/update-favColor", auth, (request, response) => {

    // Validate avatar
    const colorsList = ["black", "blue", "red", "orange", "yellow", "brown", "green", "purple"];

    if (!colorsList.includes(request.body.favColor)) {
        response.status(500).send({
            message: "color does not exist!",
            error: "Nonexistant color passed"
        });
    }
    else {
        // find the user + update
        User.findOneAndUpdate(
            {
                email: request.user.userEmail // search query
            },
            {
                favColor: request.body.favColor // field:values to update
            },
            {
                new: true, // return updated doc
                runValidators: true // validate before update
            }
        )
            // return success if the avatar is added to the database successfully
            .then((result) => {
                response.status(201).send({
                    message: "favColor updated successfully",
                    favColor: request.body.favColor,
                    result,
                });
            })
            // catch error if the avatar wasn't added successfully to the database
            .catch((error) => {
                response.status(500).send({
                    message: "Error updating favColor",
                    error,
                });
            });
    }

});

// avatar get endpoint
router.post("/get-avatar", auth, (request, response) => {

    // find the avatar
    User.findOne({
        email: request.user.userEmail // search query
    })
        // return success if the avatar is found and then send
        .then((result) => {
            if (result.avatar) {
                response.status(201).send({
                    message: "Avatar returned successfully",
                    avatar: result.avatar,
                });
            } else {
                response.status(400).send({
                    message: "No set avatar",
                    avatar: null,
                });
            }
        })
        // catch error if there is no account
        .catch((error) => {
            response.status(500).send({
                message: "Error sending avatar",
                error,
            });
        });

});

module.exports = router