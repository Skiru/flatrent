<?php

declare(strict_types=1);

namespace App\CreateFlat\UI\Controller;

use Symfony\Component\Validator\Constraints as Assert;

class CreateFlatDto
{
    public function __construct(
        #[Assert\Ulid]
        public string $id,
    ) {
    }
}
