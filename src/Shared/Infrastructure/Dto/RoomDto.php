<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Dto;

use App\CreateFlat\Domain\Flat\Room\RoomType;
use Symfony\Component\Validator\Constraints as Assert;

final readonly class RoomDto
{
    public function __construct(
        #[Assert\Ulid]
        public string $id,
        #[Assert\Length(min: 1, max: 255)]
        #[Assert\NotBlank]
        public string $name,
        #[Assert\NotBlank]
        #[Assert\Choice(callback: [RoomType::class, 'values'])]
        public string $type,
    ) {
    }
}
