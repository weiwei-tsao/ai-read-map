const btn = document.querySelector<HTMLButtonElement>('#generate-btn')!
const status = document.querySelector<HTMLDivElement>('#status')!

btn.addEventListener('click', () => {
  status.textContent = 'Wiring added in a later task.'
})
