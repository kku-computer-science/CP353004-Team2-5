const axios = require("axios");
const FormData = require("form-data");
const prisma = require("../utils/prisma");

const USER_FACE_THRESHOLD = parseFloat(
  process.env.USER_AUTO_VERIFY_CONFIDENCE_THRESHOLD ||
  process.env.AUTO_VERIFY_FACE_THRESHOLD ||
  process.env.FACE_THRESHOLD ||
  75
);

const DRIVER_FACE_THRESHOLD = parseFloat(
  process.env.DRIVER_AUTO_VERIFY_CONFIDENCE_THRESHOLD ||
  process.env.FACE_DRIVER_THRESHOLD ||
  process.env.AUTO_VERIFY_FACE_THRESHOLD ||
  process.env.FACE_THRESHOLD ||
  75
);

const FACE_API_DISABLE_PROXY =
  String(process.env.FACE_API_DISABLE_PROXY ?? "true").toLowerCase() !==
  "false";

async function compareFaces(imageUrl1, imageUrl2, apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    return { ok: false, error: "FACE_API_NOT_CONFIGURED" };
  }

  const form = new FormData();
  form.append("api_key", apiKey);
  form.append("api_secret", apiSecret);
  form.append("image_url1", imageUrl1);
  form.append("image_url2", imageUrl2);

  try {
    const response = await axios.post(
      "https://api-us.faceplusplus.com/facepp/v3/compare",
      form,
      {
        headers: form.getHeaders(),
        timeout: 20000,
        ...(FACE_API_DISABLE_PROXY ? { proxy: false } : {}),
      }
    );

    return { ok: true, confidence: Number(response?.data?.confidence || 0) };
  } catch (err) {
    console.error("Auto verify failed:", err.response?.data || err.message);
    return { ok: false, error: "FACE_API_FAILED" };
  }
}

async function autoVerifyUser(user) {
  if (!user?.nationalIdPhotoUrl || !user?.selfiePhotoUrl) {
    return { verified: false, error: "MISSING_PHOTOS" };
  }

  const result = await compareFaces(user.nationalIdPhotoUrl, 
                                    user.selfiePhotoUrl, 
                                    process.env.FACE_API_KEY, 
                                    process.env.FACE_API_SECRET);
  if (!result.ok) return { verified: false, error: result.error };

  const verified = result.confidence >= USER_FACE_THRESHOLD;
  if (verified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
  }

  return {
    verified,
    confidence: result.confidence,
    threshold: USER_FACE_THRESHOLD,
  };
}

async function autoVerifyDriverVerification(verification) {
  if (!verification?.licensePhotoUrl || !verification?.selfiePhotoUrl) {
    return { verified: false, status: "PENDING", error: "MISSING_PHOTOS" };
  }

  const result = await compareFaces(
    verification.licensePhotoUrl,
    verification.selfiePhotoUrl,
    process.env.FACE_DRIVER_KEY || process.env.FACE_API_KEY,
    process.env.FACE_DRIVER_SECRET || process.env.FACE_API_SECRET
  );
  if (!result.ok) return { verified: false, status: "PENDING", error: result.error };

  const verified = result.confidence >= DRIVER_FACE_THRESHOLD;
  if (verified) {
    await prisma.$transaction(async (tx) => {
      await tx.driverVerification.update({
        where: { id: verification.id },
        data: { status: "APPROVED" },
      });
      await tx.user.update({
        where: { id: verification.userId },
        data: { isVerified: true, role: "DRIVER" },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.driverVerification.update({
        where: { id: verification.id },
        data: { status: "REJECTED" },
      });
      await tx.user.update({
        where: { id: verification.userId },
        data: { isVerified: false, role: "PASSENGER" },
      });
      await tx.route.updateMany({
        where: {
          driverId: verification.userId,
          status: "AVAILABLE",
        },
        data: {
          status: "CANCELLED",
        },
      });
    });
  }

  return {
    verified,
    status: verified ? "APPROVED" : "REJECTED",
    confidence: result.confidence,
    threshold: DRIVER_FACE_THRESHOLD,
  };
}

module.exports = {
  autoVerifyUser,
  autoVerifyDriverVerification,
};
