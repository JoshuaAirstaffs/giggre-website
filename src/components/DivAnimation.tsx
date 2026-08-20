"use client"

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const JoshDiv = ({ children }: { children: ReactNode }) => {
  return (
   <motion.div
      className="p-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
        {children}
    </motion.div>
  )
}

export default JoshDiv
