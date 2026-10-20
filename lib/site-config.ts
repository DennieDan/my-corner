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
  email: string;
  resumeUrl: string;
  locale: string;
  avatarImage: string;
}

const siteMetadata: SiteMetadata = {
  title: "My Corner",
  author: "Dan Dinh",
  headerTitle: "stay inspired",
  description:
    "I'm Dinh Duy Linh Dan, call me Dan Dinh. Welcome to My Corner, where you can explore my projects and experience or ask Dennie, my chatbot, about me.",
  language: "en-us",
  theme: "system", // system, dark or light
  siteUrl: "https://dandinh.net",
  github: "https://github.com/DennieDan",
  linkedin: "https://www.linkedin.com/in/dandinh-dennie/",
  email: "dandinh1922@gmail.com",
  resumeUrl:
    "https://dan-public-drive-520070583275-ap-southeast-1-an.s3.ap-southeast-1.amazonaws.com/Dinh+Duy+Linh+Dan_CV.pdf",
  locale: "en-US",
  avatarImage: "/profile-img.jpg", // Path to your image
};

export default siteMetadata;
