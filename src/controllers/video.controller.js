import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType,
  } = req.query;
  const userId = req.user.id;
  //TODO: get all videos based on query, sort, pagination
  if (!isValidObjectId(userId)) {
    throw new ApiError(404, "Invalid User Id");
  }
  try {
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const options = {
      sort: { [sortBy]: sortType === "asc" ? 1 : -1 },
      skip,
      limit: parseInt(limit, 10),
    };

    let searchQuery = {};
    if (query) {
      searchQuery = { title: { $regex: query, $options: "i" } };
    }

    const aggregateVideos = await Video.aggregate([
      { $match: searchQuery },
      {
        $facet: {
          metadata: [
            {
              $count: "totalDocument",
            },
            {
              $addFields: {
                pageNumber: page,
                totalPages: {
                  $ceil: { $divide: ["$totalDocument", parseInt(limit)] },
                },
              },
            },
          ],
          videoData: [
            { $sort: options.sort },
            { $skip: options.skip },
            { $limit: options.limit },
          ],
        },
      },
    ]);
    let allVideos;
    if (aggregateVideos) {
      allVideos = {
        meta: aggregateVideos[0].metadata,
        data: aggregateVideos[0].videoData,
      };
    }
    if (allVideos.meta.length === 0) {
      throw new ApiError(404, "No video with such title available");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(200, allVideos, "Feteched all videos succeddfully...")
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Unable to retrieve videos....");
  }
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
      videoFile: {
        public_cloudinary_id: videoC?.public_id,
        url: videoC?.url,
      },
      thumbnail: {
        public_cloudinary_id: thumbnail?.public_id,
        url: thumbnail?.url,
      },
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
  if (!isValidObjectId(videoId)) {
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
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Request");
  }
  if (!(title || description || thumbnailLocalPath)) {
    throw new ApiError(400, "please provide at least one field to be updated");
  }
  try {
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
    if (thumbnailLocalPath) {
      thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    }
    if (!thumbnail) {
      throw new ApiError(
        500,
        "Error while uploading thumbnail Please try again..."
      );
    }
    await deleteOnCloudinary(video.thumbnail.public_cloudinary_id, "image");
    video.title = title ? title : video.title;
    video.description = description ? description : video.description;
    video.thumbnail = {
      public_cloudinary_id: thumbnail.public_id,
      url: thumbnail.url,
    };
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
  if (!isValidObjectId(videoId)) {
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
    await deleteOnCloudinary(video.videoFile.public_cloudinary_id, "video");
    await deleteOnCloudinary(video.thumbnail.public_cloudinary_id, "image");
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
  if (!isValidObjectId(videoId)) {
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
