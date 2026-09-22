let font;
export function loadMathFont() {
  if (!font) font = fetch('/vendor/math/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff')
    .then(async response => {
      if (!response.ok) throw new Error('本地字体加载失败，请重试');
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }).catch(error => { font = null; throw error; });
  return font;
}
