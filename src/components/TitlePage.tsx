interface ITitlePage {
    title: string
    description: string
}

const TitlePage = ({title, description}: ITitlePage) => {
  return (
    <div>
      <div className='font-bold text-2xl'>{title}</div>
      <p className='text-sm text-muted'>{description}</p>
    </div>
  )
}

export default TitlePage
