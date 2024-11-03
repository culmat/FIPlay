export async function fetchStations() {
    const response = await fetch('https://typical-butternut-stargazer.glitch.me/api/webradios/');
    const data = await response.json();
    return data;
}