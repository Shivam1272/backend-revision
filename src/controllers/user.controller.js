import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const option = {
  httpOnly: true,
  secure: true,
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(401, "User not found");
    // Generate access and refresh tokens for the user
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens.");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, fullName, email, password } = req.body;
  //   console.log(username, email, fullName, password);
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw ApiError(400, "All fields are required");
  }
  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  if (userExists) {
    if (email && userExists.email === email) {
      throw new ApiError(409, `Email ${email} already in use`);
    } else if (username && userExists.username === username) {
      throw new ApiError(409, `Username ${username} is already taken`);
    }
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }
  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong during regestring");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username and email required");
  }
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User Dosen't Exists");
  }
  //Check Password
  const matchPassword = await user.isPasswordCorrect(password);
  if (!matchPassword) {
    throw new ApiError(401, "Incorrect Email or Password");
  }
  //Create and assign a token to the user
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: "" },
    },
    {
      new: true,
    }
  );
  return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResponse(200, null, "Logged Out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFEREH_TOKEN_SECRET
    );
    console.log(decodedToken);
    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Invalid token or user does not exist.");
    }
    if (user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh Token expired");
    }
    //Setting new access token and sending it to the client side
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    res
      .status(200)
      .cookie("accessToken", accessToken, option)
      .cookie("refreshToken", newRefreshToken, option)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            newRefreshToken,
          },
          "New Access Token Generated"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Unauthorized Access");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(403, "User is not logged in!");
  }
  const user = await User.findById(userId).select({ password: true });
  if (!user) {
    throw new ApiError(404, "User Not Found");
  }
  const isMatched = await user.isPasswordCorrect(currentPassword);
  if (!isMatched) {
    throw new ApiError(401, "Incorrect Current Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user feteched Successfully"));
});

const updateAccountDetail = asyncHandler(async (req, res) => {
  const { fullName, email } = req.user;
  if (!(fullName || email)) {
    throw new ApiError(400, "Atleast one field must be updated");
  }
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        fullName: fullName || req.user.fullName,
        email: email || req.user.email,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Detail update Successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Please select an image to upload");
  }
  // Save the file name in the database
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(500, "Failed to save Image on Cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User Avatar updated Succesfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Please select an image to upload");
  }
  // Save the file name in the database
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(500, "Failed to save Image on Cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User Cover Image updated Succesfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetail,
  updateUserAvatar,
  updateUserCoverImage,
};
