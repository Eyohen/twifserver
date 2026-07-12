/* eslint-disable @typescript-eslint/naming-convention */
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadtocloudinary = async (fileBuffer) => {
    try {
        const options = {
            use_filename: true,
            folder: 'fiverr',
            public_id: `custom${Date.now()}`, // Ensuring a unique public_id for each upload
        };

        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(options, (error, result) => {
                if (error) {
                    console.log('error from uploads ::::::::: ', error);
                    reject(error);
                } else {
                    console.log('result from upload :::::::: ', result);
                    resolve({ message: 'success', url: result?.secure_url });
                }
            }).end(fileBuffer);
        });

        return result;
    } catch (error) {
        console.log(error);
        return { message: 'error', error };
    }
};

module.exports = { uploadtocloudinary };