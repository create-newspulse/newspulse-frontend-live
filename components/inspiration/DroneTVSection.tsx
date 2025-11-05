import React from 'react';
import InspirationCard, { InspirationItem } from './InspirationCard';

type Props = {
  item: InspirationItem;
};

export default function DroneTVSection({ item }: Props) {
  return (
    <div>
      <InspirationCard item={item} />
    </div>
  );
}
