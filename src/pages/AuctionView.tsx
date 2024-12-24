import React, { useEffect, useState } from "react";
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  message,
  Modal,
  Input,
} from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import AuctionTimer from "./AuctionTimer";

const { Title } = Typography;
const { Meta } = Card;

// Initialize AptosClient
const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

interface AuctionViewProps {
  marketplaceAddr: string;
}

interface Auction {
  id: number;
  nftId: number;
  seller: string;
  startPrice: number;
  currentPrice: number;
  highestBidder: string;
  startTime: number;
  endTime: number;
  active: boolean;
  nftDetails?: any;
}

const AuctionView: React.FC<AuctionViewProps> = ({ marketplaceAddr }) => {
  const { account, signAndSubmitTransaction } = useWallet();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [isBidModalVisible, setIsBidModalVisible] = useState(false);
  const [, setTimeUpdate] = useState(0);
  const FETCH_INTERVAL = 30000; // 30 seconds
  const BATCH_SIZE = 5;

  const fetchAuctions = async () => {
    const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay
    const BATCH_SIZE = 3; // Process 3 auctions at a time

    const fetchAuctionDetails = async (id: number) => {
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
        );
        const details = await client.view({
          function: `${marketplaceAddr}::NFTMarketplace::get_auction_details`,
          arguments: [marketplaceAddr, id.toString()],
          type_arguments: [],
        });

        const [
          nftId,
          seller,
          startPrice,
          currentPrice,
          highestBidder,
          startTime,
          endTime,
          active,
        ] = details;

        const nftDetails = await client.view({
          function: `${marketplaceAddr}::NFTMarketplace::get_nft_details`,
          arguments: [marketplaceAddr, nftId.toString()],
          type_arguments: [],
        });

        return {
          id,
          nftId: Number(nftId),
          seller: seller.toString(),
          startPrice: Number(startPrice) / 100000000,
          currentPrice: Number(currentPrice) / 100000000,
          highestBidder: highestBidder.toString(),
          startTime: Number(startTime),
          endTime: Number(endTime),
          active: Boolean(active),
          nftDetails: {
            ...nftDetails,
            name: decodeHexString(nftDetails[2] as string),
            description: decodeHexString(nftDetails[3] as string),
            uri: decodeHexString(nftDetails[4] as string),
          },
        };
      } catch (error) {
        console.error(`Error fetching auction ID ${id}:`, error);
        return null;
      }
    };

    try {
      // Get active auction IDs
      const response = await client.view({
        function: `${marketplaceAddr}::NFTMarketplace::get_active_auctions`,
        arguments: [marketplaceAddr],
        type_arguments: [],
      });

      if (!response || !Array.isArray(response[0])) {
        console.warn("Invalid response from get_active_auctions:", response);
        setAuctions([]);
        return;
      }

      const auctionIds = (response[0] as any[]).map(Number);
      const processedAuctions: Auction[] = []; // Process auctions in batches

      for (let i = 0; i < auctionIds.length; i += BATCH_SIZE) {
        const batch = auctionIds.slice(i, i + BATCH_SIZE); // Sequential processing within batch
        for (const id of batch) {
          const auctionData = await fetchAuctionDetails(id);
          if (auctionData) {
            processedAuctions.push(auctionData);
          }
        } // Add delay between batches

        if (i + BATCH_SIZE < auctionIds.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
          );
        }
      }

      setAuctions(processedAuctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      message.error("Failed to fetch auctions. Please try again later.");
      setAuctions([]);
    }
  };

  // Update useEffects
  useEffect(() => {
    fetchAuctions();
    const fetchInterval = setInterval(fetchAuctions, 300000); // 5 minutes
    return () => clearInterval(fetchInterval);
  }, [marketplaceAddr]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper function to decode hex strings
  const decodeHexString = (hexString: string): string => {
    try {
      const hex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
      const bytes = new Uint8Array(
        hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
      return new TextDecoder().decode(bytes);
    } catch {
      return "";
    }
  }; // Define the type for confirmation explicitly (example type)

  interface TransactionConfirmation {
    success: boolean;
    [key: string]: any; // Add any other expected properties
  }
  const handlePlaceBid = async () => {
    if (!selectedAuction || !bidAmount || !account) {
      message.error(
        "Please enter a valid bid amount and ensure you are connected."
      );
      return;
    }

    const bidAmountInOctas = Math.floor(parseFloat(bidAmount) * 100000000);
    const minIncrement = 100;
    const currentPriceInOctas = Math.floor(
      selectedAuction.currentPrice * 100000000
    );

    if (bidAmountInOctas <= currentPriceInOctas + minIncrement) {
      message.error(
        "Bid must be higher than the current price plus minimum increment."
      );
      return;
    }

    try {
      if (!signAndSubmitTransaction) {
        throw new Error("Wallet not connected properly");
      }

      const response = await signAndSubmitTransaction({
        data: {
          function: `${marketplaceAddr}::NFTMarketplace::place_bid`,
          functionArguments: [
            marketplaceAddr,
            selectedAuction.id.toString(),
            bidAmountInOctas.toString(),
          ],
          typeArguments: [],
        },
      });

      console.log("Transaction response:", response);

      if (!response?.hash) {
        throw new Error("Transaction failed - no hash received");
      }

      const txnHash = response.hash;
      console.log("Transaction hash:", txnHash);

      const confirmedTxn = await client.waitForTransactionWithResult(txnHash);
      console.log("Transaction confirmed:", confirmedTxn);

      if (confirmedTxn) {
        message.success("Bid placed successfully!");
        setIsBidModalVisible(false);
        setBidAmount("");
        await fetchAuctions();
      } else {
        throw new Error("Transaction failed during execution");
      }
    } catch (error: any) {
      console.error("Detailed error:", error);
      const errorMessage = error.message?.toLowerCase() || "";
      if (errorMessage.includes("insufficient balance")) {
        message.error("Insufficient balance to place bid");
      } else if (errorMessage.includes("rejected")) {
        message.error("Transaction rejected by wallet");
      } else if (errorMessage.includes("user rejected")) {
        message.error("Transaction cancelled by user");
      } else {
        message.error("Failed to place bid. Please try again");
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUpdate((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleEndAuction = async (auction: Auction) => {
    if (!account) {
      message.error("Please connect your wallet");
      return;
    }

    try {
      if (!signAndSubmitTransaction) {
        throw new Error("Wallet not connected properly");
      }

      const response = await signAndSubmitTransaction({
        data: {
          function: `${marketplaceAddr}::NFTMarketplace::end_auction`,
          functionArguments: [marketplaceAddr, auction.id.toString()],
          typeArguments: [],
        },
      });

      if (!response?.hash) {
        throw new Error("Transaction failed - no hash received");
      }

      const confirmedTxn = await client.waitForTransactionWithResult(
        response.hash
      );

      if (confirmedTxn) {
        message.success(
          "Auction ended successfully! NFT transferred to winner."
        );
        await fetchAuctions();
      } else {
        throw new Error("Transaction failed during execution");
      }
    } catch (error: any) {
      console.error("End auction error:", error);
      const errorMessage = error.message?.toLowerCase() || "";
      if (errorMessage.includes("auction not ended")) {
        message.error("Auction has not ended yet");
      } else if (errorMessage.includes("not active")) {
        message.error("Auction is not active");
      } else {
        message.error("Failed to end auction. Please try again");
      }
    }
  };

  const canEndAuction = (auction: Auction): boolean => {
    if (!account) return false;
    return (
      auction.active &&
      Date.now() / 1000 >= auction.endTime &&
      auction.seller === account.address
    );
  };

  return (
    <div style={{ padding: "20px" }}>
            <Title level={2}>Active Auctions</Title>     {" "}
      <Row gutter={[16, 16]}>
               {" "}
        {auctions.map((auction) => (
          <Col key={auction.id} xs={24} sm={12} md={8} lg={6}>
                       {" "}
            <Card
              hoverable
              style={{ width: "100%", marginBottom: "16px" }}
              cover={
                <img
                  alt={auction.nftDetails?.name || `NFT ${auction.nftId}`}
                  src={auction.nftDetails?.uri}
                  style={{ height: "200px", objectFit: "cover" }}
                />
              }
              actions={[
                <Button
                  type="primary"
                  onClick={() => {
                    setSelectedAuction(auction);
                    setIsBidModalVisible(true);
                  }}
                  disabled={!auction.active}
                >
                  Place Bid
                </Button>,
                <Button
                  type="default"
                  onClick={() => handleEndAuction(auction)}
                  disabled={
                    !auction.active ||
                    Date.now() / 1000 < auction.endTime ||
                    auction.seller !== account?.address
                  }
                >
                  End Auction
                </Button>,
              ]}
            >
              <Meta
                title={auction.nftDetails?.name || `NFT #${auction.nftId}`}
                description={
                  <div>
                               {" "}
                    <p>
                                      <strong>Current Price:</strong>{" "}
                      {auction.currentPrice} APT            {" "}
                    </p>
                               {" "}
                    <p>
                                      <strong>Highest Bidder:</strong>          
                           {" "}
                      {`${auction.highestBidder.slice(
                        0,
                        6
                      )}...${auction.highestBidder.slice(-4)}`}
                                 {" "}
                    </p>
                               {" "}
                    <p>
                                      <strong>Time:</strong>{" "}
                      <AuctionTimer endTime={auction.endTime} />           {" "}
                    </p>
                               {" "}
                    <p>
                                      <strong>Description:</strong>{" "}
                      {auction.nftDetails?.description}           {" "}
                    </p>
                           {" "}
                  </div>
                }
              />
                         {" "}
            </Card>
                     {" "}
          </Col>
        ))}
             {" "}
      </Row>
           {" "}
      <Modal
        title="Place Bid"
        visible={isBidModalVisible}
        onCancel={() => setIsBidModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBidModalVisible(false)}>
                        Cancel          {" "}
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handlePlaceBid}
            disabled={
              !bidAmount ||
              parseFloat(bidAmount) <= (selectedAuction?.currentPrice || 0)
            }
          >
                        Place Bid          {" "}
          </Button>,
        ]}
      >
               {" "}
        {selectedAuction && (
          <>
                       {" "}
            <p>
                            <strong>NFT Name:</strong>{" "}
              {selectedAuction.nftDetails?.name}           {" "}
            </p>
                       {" "}
            <p>
                            <strong>Current Price:</strong>{" "}
              {selectedAuction.currentPrice} APT            {" "}
            </p>
                       {" "}
            <p>
                            <strong>Minimum Bid:</strong>              {" "}
              {(selectedAuction.currentPrice + 0.1).toFixed(2)} APT 
            </p>
\            <Input
              type="number"
              placeholder="Enter bid amount in APT"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              min={(selectedAuction.currentPrice + 0.000001).toFixed(6)}
              step="0.000001"
              style={{ marginTop: "10px" }}
            />
          </>
        )}
        
      </Modal>
      
    </div>
  );
};

export default AuctionView;