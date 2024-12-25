
import { useEffect, useState } from "react";

interface AuctionTimerProps {
    endTime: number;
}

const AuctionTimer: React.FC<AuctionTimerProps> = ({ endTime }) => {
    const [timeString, setTimeString] = useState<string>("");

    useEffect(() => {
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = endTime - now;
            
            if (remaining <= 0) {
                setTimeString("Ended");
                return;
            }

            // Only show days if the remaining time is more than 24 hours
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;

            const parts = [];
            
            // Only add days if there are any
            if (days > 0) {
                parts.push(`${days}d`);
            }
            
            // Only add hours if there are any or if there are days
            if (hours > 0 || days > 0) {
                parts.push(`${hours}h`);
            }
            
            // Always show minutes and seconds
            parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            setTimeString(parts.join(' ') + " remaining");
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [endTime]);

    return <span>{timeString}</span>;
};

export default AuctionTimer;
