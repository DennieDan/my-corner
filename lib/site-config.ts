interface SiteMetadata {
  title: string;
  author: string;
  headerTitle: string;
  description: string;
  language: string;
  theme: string;
  siteUrl: string;
  github: string;
  linkedin: string;
  resumeUrl: string;
  locale: string;
  avatarImage: string;
}

const siteMetadata: SiteMetadata = {
  title: "My Corner",
  author: "Dan Dinh",
  headerTitle: "stay inspired",
  description:
    "Welcome to my corner. You can simply ask what you want to know about me, by talking with Dennie - a 24/24 chatbot version of me. No rush, let's see what I have on my plate first.",
  language: "en-us",
  theme: "system", // system, dark or light
  siteUrl: "https://dandinh.com",
  github: "https://github.com/DennieDan",
  linkedin: "https://www.linkedin.com/in/dandinh-dennie/",
  resumeUrl:
    "https://dan-public-drive-520070583275-ap-southeast-1-an.s3.ap-southeast-1.amazonaws.com/Dinh+Duy+Linh+Dan_CV.pdf",
  locale: "en-US",
  avatarImage: "/profile-img.jpg", // Path to your image
};

export default siteMetadata;
