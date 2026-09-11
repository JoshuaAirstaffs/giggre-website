"use client";

import { Sparkles, Users, UserSearch } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuickGigForm from "./components/QuickGigForm";
import OpenGigForm from "./components/OpenGigForm";
import OfferedGigForm from "./components/OfferedGigForm";

export default function PostGigPage() {
  return (
    <JoshDiv>
      <TitlePage title="Post a gig" description="Choose how you want to get this job done" />

      <div className="mt-6 max-w-6xl">
        <Tabs defaultValue="quick">
          <TabsList className="bg-secondary">
            <TabsTrigger value="quick" className="gap-1.5 data-active:bg-(--quick-start) data-active:text-white">
              <Sparkles className="size-3.5" />
              Quick
            </TabsTrigger>
            <TabsTrigger value="open" className="gap-1.5 data-active:bg-worker data-active:text-white">
              <Users className="size-3.5" />
              Open
            </TabsTrigger>
            <TabsTrigger value="offered" className="gap-1.5 data-active:bg-(--offered-start) data-active:text-white">
              <UserSearch className="size-3.5" />
              Offered
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <QuickGigForm />
          </TabsContent>

          <TabsContent value="open" className="mt-4">
            <OpenGigForm />
          </TabsContent>

          <TabsContent value="offered" className="mt-4">
            <OfferedGigForm />
          </TabsContent>
        </Tabs>
      </div>
    </JoshDiv>
  );
}
