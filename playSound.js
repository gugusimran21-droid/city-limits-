let audio = null;

export const playAlarm = (soundUrl = '/sounds/alarm.wav', loop = true) => {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  audio = new Audio(soundUrl);
  audio.loop = loop;
  audio.volume = 1; // loud
  audio.play().catch(err =>{
    console.log("Sound blocked:", err);
});
};
export const stopAlarm = () => {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
};