async function run() {
    console.log("Starting analysis...");
    const url = "https://www.modetour.com/package/104409383?MLoc=99&Pnum=104409383&Sno=C117876&ANO=81440&thru=crs";

    try {
        const res = await fetch('http://localhost:3000/api/crawl-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, source: 'confirmation' })
        });

        const text = await res.text();
        console.log("Response text length:", text.length);

        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error("Non-JSON:", text.substring(0, 500));
            return;
        }

        if (json.success && json.data) {
            const raw = json.data.raw || json.data;
            console.log("\n--- Extracted Data ---");
            console.log("Title:", raw.title);
            console.log("Airline:", raw.airline);
            console.log("Flight Times:", raw.departureTime, "->", raw.arrivalTime);
            console.log("Hotel:", JSON.stringify(raw.hotel, null, 2));
            console.log("Itinerary length:", raw.itinerary ? raw.itinerary.length : 0);

            // Console log the full raw object if hotel is missing
            if (!raw.hotel || !raw.departureTime) {
                console.log("\n--- Full Raw Data ---");
                console.log(JSON.stringify(raw, null, 2));
            }
        } else {
            console.log("Failed:", json);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
