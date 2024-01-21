import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.id;
  try {
    const videoLocalPath = req.files?.videoFile[0]?.path || "";
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path || "";
    if (!videoLocalPath || !thumbnailLocalPath) {
      throw new ApiError(422, "Missing file data");
    }
    const videoC = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!videoC) {
      throw new ApiError(400, "Unable to upload video on Cloudinary");
    }
    if (!thumbnail) {
      throw new ApiError(400, "Unable to upload thubmnail on Cloudinary");
    }
    const video = await Video.create({
      title,
      description,
      videoFile: videoC.url,
      thumbnail: thumbnail.url,
      duration: videoC.duration > 60 ? videoC.duration / 60 : videoC.duration,
      owner: userId,
    });
    if (!video) {
      return new ApiError(500, "Server Error");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video uploaded successfully"));
  } catch (error) {
    throw new ApiError(401, "Please Provide all Data");
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "Invalid request");
  }
  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(404, "No video found with this id");
    }
    return res
      .status(201)
      .json(new ApiResponse(200, video, "Video retrieved Successfully"));
  } catch (error) {
    throw new ApiError(404, error?.message || "Invalid request");
  }
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;
  const userId = req.user.id;
  let thumbnail;
  if (!videoId) {
    throw new ApiError(400, "Invalid Request");
  }
  if (!(title || description || thumbnailLocalPath)) {
    throw new ApiError(400, "please provide at least one field to be updated");
  }
  try {
    if (thumbnailLocalPath) {
      thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    }
    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(404, "No video found with this id");
    }
    // console.log(``);
    if (userId != video.owner) {
      throw new ApiError(
        403,
        "You are not authorized to perform this action on this video"
      );
    }
    video.title = title ? title : video.title;
    video.description = description ? description : video.description;
    video.thumbnail = thumbnail ? thumbnail.url : video.thumbnail;
    await video.save();
    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video Details Updated"));
  } catch (error) {
    throw new ApiError(400, error?.message || "Invalid request");
  }
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.id;
  //TODO: delete video
  if (!videoId) {
    throw new ApiError(400, "Invalid request");
  }
  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(404, "No video found with this id!");
    }
    if (video.owner.toString() !== userId.toString()) {
      throw new ApiError(401, "User is not the owner of this video!");
    }
    await Video.findByIdAndDelete(videoId);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Video Deleted Successfully"));
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access");
  }
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.id;
  if (!videoId) {
    throw new ApiError(400, "Invalid Request");
  }
  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(404, "Invalid video Id");
    }
    if (video.owner.toString() !== userId.toString()) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action."
      );
    }
    video.isPublished = !video.isPublished;
    await video.save();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { video: video.toJSON() },
          "Video Published Status Updated"
        )
      );
  } catch (error) {
    throw new ApiError(500, "Something went wrong Please try again.....");
  }
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
