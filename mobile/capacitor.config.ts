const config = {
  appId: "app.docent.guide",
  appName: "Docent",
  webDir: "www",
  server: {
    url: "https://docent-drab.vercel.app",
    errorPath: "offline.html",
    androidScheme: "https",
    allowNavigation: ["docent-drab.vercel.app"],
  },
  android: {
    allowMixedContent: false,
    useLegacyBridge: true,
    backgroundColor: "#101214",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#101214",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#101214",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#101214",
      overlaysWebView: false,
    },
    BackgroundGeolocation: {},
  },
};

export default config;
