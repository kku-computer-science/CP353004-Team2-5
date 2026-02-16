const axios = require("axios");
const FormData = require("form-data");
const prisma = require("../utils/prisma");

const FACE_THRESHOLD = parseFloat(process.env.FACE_THRESHOLD || 75);

async function autoVerifyUser(user) {

    if (!user.nationalIdPhotoUrl || !user.selfiePhotoUrl) {
        throw new Error("Missing photo URLs");
    }

    const form = new FormData();
    form.append("api_key", process.env.FACE_API_KEY);
    form.append("api_secret", process.env.FACE_API_SECRET);
    form.append("image_url1", user.nationalIdPhotoUrl);
    form.append("image_url2", user.selfiePhotoUrl);

    try {
        const response = await axios.post(
            "https://api-us.faceplusplus.com/facepp/v3/compare",
            form,
            { headers: form.getHeaders(), timeout: 10000 }
        );

        const confidence = response.data.confidence;

        if (confidence >= FACE_THRESHOLD) {

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    isVerified: true
                }
            });

            return {
                verified: true,
                confidence
            };
        }

        return {
            verified: false,
            confidence
        };

    } catch (err) {
        console.error("Auto verify failed:", err.response?.data || err.message);

        return {
            verified: false,
            error: "Face API failed"
        };
    }
}

module.exports = { autoVerifyUser };
