"use client";

import JoshDiv from "@/components/DivAnimation";
import TitlePage from "@/components/TitlePage";
import { TutorialLibrary } from "@/components/TutorialVideos";

// Mirrors the app's Profile → Settings → Video Tutorials
// (giggre_app lib/features/tutorial_videos/video_tutorials_screen.dart).
export default function WorkerTutorialsPage() {
  return (
    <JoshDiv>
      <TitlePage title="Video Tutorials" description={'Short how-to videos — search by topic, e.g. "sign up" or "top up".'} />
      <TutorialLibrary hideIntro />
    </JoshDiv>
  );
}
