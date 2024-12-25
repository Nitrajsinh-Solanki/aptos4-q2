import React, { useState, useEffect } from "react";
import { List, Button, message, Spin } from "antd";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

interface NFT {
  id: number;
  name: string;
  description: string;
  uri: string;
}

interface Offer {
  buyer: string;
  nft_id: number;
  amount: number;
  timestamp: number;
  status: number;
  index: number;
  nft_name?: string;
}

const ReceivedOffers: React.FC<{ marketplaceAddr: string }> = ({
  marketplaceAddr,
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const { account } = useWallet();
  const [nfts, setNfts] = useState<{ [key: number]: NFT }>({});

  const fetchNFTDetails = async () => {
    try {
      const response = await client.getAccountResource(
        marketplaceAddr,
        `${marketplaceAddr}::NFTMarketplace::Marketplace`
      );
      const nftList = (response.data as { nfts: NFT[] }).nfts;
      const nftMap = nftList.reduce((acc: { [key: number]: NFT }, nft) => {
        const decodedName = new TextDecoder().decode(
          new Uint8Array(Buffer.from(nft.name.slice(2), "hex"))
        );
        acc[nft.id] = { ...nft, name: decodedName };
        return acc;
      }, {});
      setNfts(nftMap);
    } catch (error) {
      console.error("Error fetching NFT details:", error);
    }
  };

  const fetchOffers = async () => {
    if (!account?.address) return;
    try {
      const resourceType = `${marketplaceAddr}::NFTMarketplace::OfferStore`;
      const exists = await client
        .getAccountResource(marketplaceAddr, resourceType)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        setOffers([]);
        setLoading(false);
        return;
      } // First, get all NFTs owned by the current user
      const ownedNFTsResponse = await client.getAccountResource(
        marketplaceAddr,
        `${marketplaceAddr}::NFTMarketplace::Marketplace`
      );
      const allNFTs = (ownedNFTsResponse.data as { nfts: any[] }).nfts;
      const userOwnedNFTIds = allNFTs
        .filter((nft) => nft.owner === account.address)
        .map((nft) => nft.id); // Then fetch all offers

      const response = await client.getAccountResource(
        marketplaceAddr,
        resourceType
      );
      if (response?.data) {
        const data = response.data as { offers: Offer[] };
        const relevantOffers = data.offers.filter(
          (offer) =>
            offer.status === 0 && // Pending offers only
            userOwnedNFTIds.includes(offer.nft_id) // Offers for user's NFTs only
        ); // Map NFT details to offers
        const offersWithNames = await Promise.all(
          relevantOffers.map(async (offer) => {
            const nftDetails = nfts[offer.nft_id];
            return {
              ...offer,
              nft_name: nftDetails?.name || `NFT #${offer.nft_id}`,
            };
          })
        );
        setOffers(offersWithNames);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerIndex: number, nftId: number) => {
    try {
      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::accept_offer`,
        type_arguments: [],
        arguments: [marketplaceAddr, offerIndex.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        payload
      );
      await client.waitForTransaction(response.hash);
      message.success("Offer accepted successfully!");
      fetchOffers();
    } catch (error) {
      console.error("Error accepting offer:", error);
      message.error("Failed to accept offer");
    }
  };

  const handleDeclineOffer = async (offerIndex: number) => {
    try {
      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::decline_offer`,
        type_arguments: [],
        arguments: [marketplaceAddr, offerIndex.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        payload
      );
      await client.waitForTransaction(response.hash);
      message.success("Offer declined successfully!");
      fetchOffers();
    } catch (error) {
      console.error("Error declining offer:", error);
      message.error("Failed to decline offer");
    }
  };

  useEffect(() => {
    if (marketplaceAddr && account?.address) {
      fetchNFTDetails().then(() => fetchOffers());
    }
  }, [marketplaceAddr, account?.address]);

  if (loading) {
    return <Spin size="large" />;
  }

  return (
    <List
      itemLayout="horizontal"
      dataSource={offers}
      locale={{ emptyText: "No pending offers available" }}
      renderItem={(offer) => (
        <List.Item
          actions={[
            <Button
              onClick={() => handleAcceptOffer(offer.index, offer.nft_id)}
              type="primary"
            >
                                          Accept                        {" "}
            </Button>,
            <Button onClick={() => handleDeclineOffer(offer.index)} danger>
                                          Decline                        {" "}
            </Button>,
          ]}
        >
          <List.Item.Meta
            title={`Offer for ${offer.nft_name}`}
            description={
              <>
                <p>Buyer: {offer.buyer}</p>                               {" "}
                <p>Amount: {offer.amount / 100000000} APT</p>                   
                           {" "}
                <p>
                  Status: {["Pending", "Accepted", "Declined"][offer.status]}
                </p>
                                               {" "}
                <p>Date: {new Date(offer.timestamp * 1000).toLocaleString()}</p>
                                           {" "}
              </>
            }
          />
                         {" "}
        </List.Item>
      )}
    />
  );
};

export default ReceivedOffers;
