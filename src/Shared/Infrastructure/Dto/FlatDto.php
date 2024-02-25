<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final readonly class FlatDto
{
    /**
     * @param array<RoomDto> $rooms
     */
    public function __construct(
        #[Assert\Ulid]
        public string $id,
        #[Assert\Valid]
        public AddressDto $address,
        #[Assert\Valid]
        public array $rooms = [],
        #[Assert\Ulid]
        public ?string $ownerId = null,
    ) {
    }
}
