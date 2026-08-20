import { verifySession } from "@/lib/dal";

const Post = async () => {
  await verifySession();

  return (
    <div>
      Post
    </div>
  )
}

export default Post
