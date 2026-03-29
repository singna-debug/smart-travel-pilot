const url = "https://www.modetour.com/package/104409383?MLoc=99&Pnum=104409383&Sno=C117876&ANO=81440&thru=crs";
const productNoMatch = url.match(/package\/(\d+)/i) || url.match(/Pnum=(\d+)/i);

console.log("URL:", url);
if (productNoMatch) {
    console.log("Matched Product No:", productNoMatch[1]);
} else {
    console.log("No Match");
}
