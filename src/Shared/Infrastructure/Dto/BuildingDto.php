<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final readonly class BuildingDto
{
    public function __construct(
        #[Assert\Positive]
        public int $number,
        #[Assert\Positive]
        public ?int $doorNumber = null,
        #[Assert\Positive]
        public ?int $flatNumber = null,
    ) {
    }
}
