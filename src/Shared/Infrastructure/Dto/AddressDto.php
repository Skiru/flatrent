<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final readonly class AddressDto
{
    public function __construct(
        #[Assert\Ulid]
        public string $id,
        #[Assert\NotBlank]
        #[Assert\Length(min: 1, max: 255)]
        #[Assert\NoSuspiciousCharacters]
        public string $city,
        #[Assert\NotBlank]
        #[Assert\Length(min: 1, max: 255)]
        #[Assert\NoSuspiciousCharacters]
        public string $street,
        #[Assert\NotBlank]
        #[Assert\Length(6)]
        public string $zipCode,
        #[Assert\Valid]
        public BuildingDto $building,
    ) {
    }
}
